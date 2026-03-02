# DRAFT -- Observer Commons Protocol: Trust & Governance Framework

**Status:** DRAFT
**Version:** 0.1
**Date:** 2026-03-01
**Author:** Sub-Agent 3 (Trust & Governance Designer)
**ISC Criteria:** ISC-Trust-1 through ISC-Trust-6, ISC-A-Trust-1
**Depends on:** 01-schema-spec.md (solution record schema), 02-federation-spec.md (transport layer)

---

## 0. Preamble: Surveyor Epistemology

Land surveyors do not trust a single measurement. They triangulate from multiple independent points to establish position. The margin of error narrows not because any single measurement improves, but because independent measurements constrain one another. A single reading can be wildly wrong. Three independent readings that agree are almost certainly right.

The Observer Commons applies this principle to solution trustworthiness. No single validator -- no matter how authoritative -- can establish that a solution is trustworthy. Trust emerges from the convergence of independent validations across different contexts, organisations, and time periods. A solution validated by five independent vaults in three different industries is more trustworthy than one validated twenty times by the same organisation.

This is not a popularity contest. Star counts measure attention. Surveyor epistemology measures independent confirmation.

### Core Axiom

> **Trust = f(independent_validation_count, validation_diversity, context_coverage, time_stability)**
>
> Trust is NOT f(total_endorsements) and NOT f(authority_of_endorser).

---

## 1. Trust Model Architecture

### 1.1 Trust as Multi-Dimensional Vector (ISC-Trust-1)

Trust is not a single number. A single score obscures the dimensions that matter for decision-making. Instead, each solution record carries a **Trust Vector** with six independent dimensions:

```
TrustVector {
  validation_count:     uint      // Total independent validations
  validation_diversity: float     // 0.0-1.0, diversity of validator origins
  context_breadth:      float     // 0.0-1.0, range of contexts tested
  temporal_stability:   float     // 0.0-1.0, consistency over time
  test_coverage:        float     // 0.0-1.0, automated test evidence
  documentation_quality: float    // 0.0-1.0, completeness of docs
}
```

Each dimension is independently meaningful:

| Dimension | What It Measures | Why It Matters |
|---|---|---|
| `validation_count` | Number of independent validations received | Raw signal strength -- more independent measurements = tighter triangulation |
| `validation_diversity` | Organisational/geographic spread of validators | Sybil resistance -- diverse validators are harder to fake |
| `context_breadth` | Range of problem contexts where solution was applied | Generalisability -- does it work outside the original context? |
| `temporal_stability` | How long the solution has maintained positive validations | Durability -- fads score high briefly then decay |
| `test_coverage` | Whether automated tests accompany the solution | Verifiability -- can others reproduce the claimed results? |
| `documentation_quality` | Completeness of rationale, constraints, trade-offs | Comprehensibility -- can others understand WHY it works? |

### 1.2 Composite Trust Score

For contexts where a single sortable value is needed (search ranking, threshold checks), the vector collapses to a **Composite Trust Score (CTS)** using a weighted geometric mean:

```
CTS = (
  validation_count^w1 *
  validation_diversity^w2 *
  context_breadth^w3 *
  temporal_stability^w4 *
  test_coverage^w5 *
  documentation_quality^w6
) ^ (1 / sum(w1..w6))
```

Default weights (DRAFT, tunable per vault):

| Dimension | Weight | Rationale |
|---|---|---|
| validation_count | 0.25 | Important but gameable in isolation |
| validation_diversity | 0.30 | Highest weight -- diversity is the core Sybil defence |
| context_breadth | 0.20 | Generalisability matters for a commons |
| temporal_stability | 0.10 | Reward durability, but don't penalise new solutions |
| test_coverage | 0.10 | Valuable but not all solutions are testable |
| documentation_quality | 0.05 | Baseline quality, not a trust differentiator |

**Geometric mean is intentional.** A zero in any dimension drags the composite down. A solution with 100 validations but zero diversity scores poorly. This prevents gaming a single axis.

### 1.3 Validation Independence Model

The fundamental constraint of surveyor epistemology is **independence**. Two measurements from the same instrument are not independent. Two validations from the same organisation are not fully independent.

**Independence is measured on a spectrum, not a binary:**

| Independence Level | Description | Weight Multiplier |
|---|---|---|
| **Full** (1.0) | Different organisation, different context, no shared contributors | 1.0x |
| **Partial** (0.5) | Same organisation but different team, or different org but similar context | 0.5x |
| **Minimal** (0.2) | Same team, same context, different time period | 0.2x |
| **None** (0.0) | Duplicate validation, same actor, or detected collusion | 0.0x (discarded) |

Independence is assessed by comparing validator metadata:

```
IndependenceCheck(validation_a, validation_b):
  org_match   = a.vault_org == b.vault_org          // same organisation?
  ctx_match   = overlap(a.context_tags, b.context_tags) > 0.5  // similar context?
  contrib_match = overlap(a.contributors, b.contributors) > 0.3 // shared people?

  if org_match AND ctx_match AND contrib_match: return 0.0   // not independent
  if org_match AND (ctx_match OR contrib_match): return 0.2   // minimal
  if org_match XOR ctx_match: return 0.5                      // partial
  return 1.0                                                   // full independence
```

**Effective Validation Count** replaces raw count:

```
effective_count = sum(independence_weight_i for each validation_i)
```

A solution with 10 validations from 10 different organisations scores an effective count of 10. A solution with 10 validations from the same organisation scores approximately 2 (first one at 1.0, remaining 9 at ~0.2 each, minus duplicates).

### 1.4 Minimum Thresholds for Confidence Levels

Different confidence levels require different minimum effective validation counts:

| Confidence Level | Min Effective Validations | Min Diversity | Min Contexts | Cynefin Gate |
|---|---|---|---|---|
| `speculative` | 0 | -- | -- | Disorder/Chaotic |
| `provisional` | 1 | 0.0 | 1 | Chaotic/Complex |
| `tested` | 3 | 0.3 | 2 | Complex/Complicated |
| `proven` | 7 | 0.5 | 3 | Complicated/Simple |
| `foundational` | 15 | 0.7 | 5 | Simple (well-established) |

These thresholds are DRAFT and should be calibrated against real data once the commons has sufficient solutions. The key principle: **foundational status requires broad independent confirmation, not just volume.**

---

## 2. Provenance Tracking (ISC-Trust-2)

### 2.1 Provenance Chain

Every solution record maintains a complete provenance chain as an append-only event log. This is the solution's "chain of custody" -- every significant event from creation to current state.

```
ProvenanceChain {
  events: ProvenanceEvent[]  // ordered, append-only
}

ProvenanceEvent {
  event_id:    uuid
  timestamp:   ISO8601
  event_type:  enum          // see 2.2
  actor:       ActorRef      // who did this
  vault_id:    string        // which vault recorded this
  parent_id:   uuid | null   // previous event in chain (null for creation)
  payload:     object        // event-specific data
  signature:   string        // cryptographic signature of event content
}

ActorRef {
  type:    "human" | "ai" | "system"
  id:      string           // vault-scoped identifier
  org:     string | null    // organisation identifier
}
```

### 2.2 Provenance Event Types

| Event Type | Trigger | Payload |
|---|---|---|
| `creation` | Solution first published | `{author, context, initial_cynefin, source_vault}` |
| `modification` | Content updated | `{fields_changed[], rationale, diff_hash}` |
| `fork` | Solution derived from another | `{source_solution_id, source_version, fork_rationale}` |
| `merge` | Forked changes merged back | `{fork_id, merge_rationale, conflicts_resolved[]}` |
| `validation` | Independent validation submitted | `{validator, context, outcome, evidence_hash, independence_level}` |
| `promotion` | Confidence level changed | `{from_confidence, to_confidence, rationale, gated_by}` |
| `cynefin_reclassification` | Domain classification changed | `{from_domain, to_domain, rationale, evidence[]}` |
| `deprecation` | Solution marked as superseded | `{replacement_id, deprecation_rationale}` |
| `challenge` | Validity of solution contested | `{challenger, grounds, evidence[]}` |
| `challenge_resolution` | Challenge resolved | `{resolution, rationale, adjudicator}` |

### 2.3 Provenance Integrity

Each provenance event includes:

1. **Parent hash chaining** -- each event references the hash of the previous event, creating a tamper-evident chain. If any event is modified, all subsequent hashes break.
2. **Vault signatures** -- events are signed by the originating vault's key. This does not require a blockchain. It requires each vault to maintain a keypair and for signatures to be verifiable by any other vault in the federation.
3. **Conflict resolution** -- if two vaults submit conflicting provenance events (fork in the chain), the federation layer mediates using timestamp ordering and vault reputation. This is a Last-Writer-Wins CRDT with human arbitration for disputes.

### 2.4 Provenance Queries

The provenance chain supports these queries without AI:

- **Full lineage**: "Show me every event for this solution since creation"
- **Fork tree**: "Show me all forks of this solution and their current states"
- **Validation history**: "Show me all validations, their independence levels, and their outcomes"
- **Contributor graph**: "Who has contributed to this solution, across all faults?"
- **Challenge history**: "Has this solution ever been challenged? What was the outcome?"

---

## 3. Cynefin Gates for Solution Maturity (ISC-Trust-3)

### 3.1 Domain Classification

Every solution in the Commons carries a **Cynefin domain classification** that determines what kind of trust model applies and what validation approach is appropriate.

| Domain | Label | Characteristics | Trust Model |
|---|---|---|---|
| **Simple/Clear** | Best Practice | Cause-effect obvious, repeatable, context-independent | High trust with fewer validations; solution should work anywhere |
| **Complicated** | Good Practice | Cause-effect discoverable with expertise, multiple valid approaches | Moderate trust; expert validation weighted higher |
| **Complex** | Emergent Practice | Cause-effect only visible in retrospect, context-dependent | Trust is context-bound; validation must include context metadata |
| **Chaotic** | Novel Practice | No clear cause-effect, experimental | Low baseline trust; rapid iteration expected |
| **Disorder** | Unclassified | Insufficient information to classify | No trust score calculated; classification required before trust accrues |

### 3.2 Cynefin-Adjusted Trust Scoring

The Cynefin domain modifies how trust scores are calculated:

**Simple domain:**
- Lower validation thresholds (the solution is expected to be repeatable)
- Context breadth matters less (solution is context-independent)
- Temporal stability matters more (best practices should be stable)
- Minimum 3 effective validations to reach `proven`

**Complicated domain:**
- Standard validation thresholds
- Validator expertise is weighted (an expert validation counts more than a novice endorsement)
- Multiple valid approaches may exist -- trust scores for alternatives are independent
- Minimum 5 effective validations to reach `proven`

**Complex domain:**
- Higher validation thresholds (context-dependence means more testing needed)
- Context breadth is critical (each new context is genuinely new information)
- Trust score carries context tags: "trusted in {healthcare, regulated, >1000 users}"
- Trust does NOT generalise: high trust in Context A does not imply trust in Context B
- Minimum 10 effective validations across 4+ contexts to reach `proven`

**Chaotic domain:**
- Maximum confidence level capped at `tested` regardless of validation count
- Solutions are expected to mutate rapidly
- Trust decays faster (temporal_stability half-life = 90 days vs 365 for Simple)
- Used for experimental approaches that may stabilise into Complex or Complicated

**Disorder:**
- No trust score calculated
- Solution is visible in the Commons but flagged as unclassified
- Any vault can propose a classification (this creates a provenance event)
- Classification requires human approval at the proposing vault

### 3.3 Domain Transitions

Solutions can move between Cynefin domains as understanding improves:

```
Disorder --> any domain     (initial classification, requires human decision)
Chaotic --> Complex          (pattern emerges from experimentation)
Complex --> Complicated      (expertise codifies the approach)
Complicated --> Simple       (approach becomes standard practice)

Reverse transitions also valid:
Simple --> Complicated       (new context reveals hidden complexity)
Complicated --> Complex      (assumed expertise proves insufficient)
Any --> Chaotic              (fundamental assumptions invalidated)
```

**All domain transitions require:**
1. A provenance event with rationale
2. Human approval at the vault proposing the transition
3. Notification to all vaults that have validated the solution
4. A 30-day comment period before the transition takes effect for `proven` or `foundational` solutions

### 3.4 Confidence Ladder Mapping

The existing Observer Vault confidence ladder maps to Cynefin gates:

| Confidence | Cynefin Alignment | Meaning in Commons Context |
|---|---|---|
| `speculative` | Disorder / Chaotic | Idea exists, untested, unclassified |
| `provisional` | Chaotic / Complex | Some evidence, limited validation, context-specific |
| `tested` | Complex / Complicated | Multiple independent validations, context documented |
| `proven` | Complicated / Simple | Broad independent confirmation, works across contexts |
| `foundational` | Simple | Established best practice, extremely high confidence |

---

## 4. Anti-Gaming Measures (ISC-Trust-4)

### 4.1 Threat Model

The trust system faces four primary attack vectors:

| Attack | Description | Impact |
|---|---|---|
| **Sybil** | One actor creates multiple fake validator identities | Inflates validation_count, fakes diversity |
| **Collusion** | Multiple actors coordinate to validate each other's solutions | Creates appearance of independence where none exists |
| **Reputation Farming** | Actor validates many solutions to build credibility, then exploits it | Trusted identity used to push untrustworthy solutions |
| **Trust Decay Evasion** | Actor re-validates own solution periodically to prevent decay | Artificially maintains temporal_stability |

### 4.2 Sybil Resistance

**Problem:** In a federated system without central identity, how do you prevent one person from running 50 vaults and self-validating?

**Layered defence (no single measure is sufficient):**

1. **Vault Identity Binding**
   - Each vault has a cryptographic keypair generated on first federation join
   - Vault keys are bound to a DNS domain or a Git repository (verifiable external identity)
   - Creating a fake vault requires creating a fake domain or repository -- possible, but raises the cost
   - Cost-of-identity: the system does not need to make Sybil attacks impossible, just expensive enough to not be worth it for the trust gained

2. **Proof of Engagement**
   - Validations require structured evidence: what was tested, in what context, what was the outcome
   - Empty validations ("it works, trust me") receive zero weight
   - Evidence is hashed and included in provenance; fabricated evidence can be challenged
   - Minimum validation payload:
     ```
     ValidationEvidence {
       context_description: string  // where was this applied?
       environment:         object  // technical context (language, framework, scale)
       outcome:             enum    // success | partial | failure | inconclusive
       evidence_type:       enum    // automated_test | manual_test | production_use | code_review | theoretical_review
       evidence_hash:       string  // hash of supporting artifact (test results, logs, etc.)
       duration_of_use:     string  // how long has this been in use?
     }
     ```

3. **Diversity Scoring**
   - Validation diversity is computed from vault metadata (organisation, geography, domain)
   - Validations from vaults with overlapping metadata score lower independence (Section 1.3)
   - A solution validated by 10 vaults all registered to the same Git org scores poorly on diversity

4. **New Vault Cool-Down**
   - Newly federated vaults have a 90-day probationary period
   - During probation, their validations carry 0.25x weight
   - Probation ends after the vault has: existed for 90 days, published at least 3 solutions, and received at least 1 validation from a non-probationary vault
   - This makes Sybil attacks slow: creating 50 fake vaults gives you 50 * 0.25 = 12.5 effective validations, spread over 90 days

### 4.3 Collusion Detection

**Problem:** Three real organisations agree to validate each other's solutions regardless of quality.

**Detection heuristics (run periodically, results flagged for human review):**

1. **Reciprocity Analysis**
   - If Vault A validates Vault B's solutions AND Vault B validates Vault A's solutions at a rate significantly above the network average, flag for review
   - Metric: `reciprocity_score = validations_A_to_B * validations_B_to_A / network_average_reciprocity`
   - Threshold: reciprocity_score > 3.0 triggers a flag

2. **Temporal Clustering**
   - If multiple validations for the same solution arrive within a short window from vaults that don't normally validate together, flag for review
   - Metric: `temporal_cluster_score = count(validations within 24h) / expected_rate`
   - This catches coordinated validation campaigns

3. **Validation Depth Analysis**
   - Compare evidence depth across a vault's validations
   - If a vault provides detailed evidence for some solutions but boilerplate for others, the boilerplate validations are down-weighted
   - This makes collusion more expensive: you have to fabricate detailed evidence for each colluded validation

4. **Graph Analysis**
   - Build a graph of vault-to-vault validation relationships
   - Identify unusually dense subgraphs (cliques) -- these may indicate collusion rings
   - Clique detection is computationally tractable on the expected graph sizes (thousands of vaults, not millions)

**CRITICAL: Collusion detection is advisory, not punitive.** Flags are surfaced to human governance participants. Automated punishment creates new attack vectors (false accusations). Humans decide what to do with flagged patterns.

### 4.4 Trust Decay

**Problem:** A solution validated two years ago may no longer be valid. Technology changes. Context changes.

**Time-based decay model:**

```
decayed_weight = original_weight * decay_factor^(age_in_days / half_life)

where:
  decay_factor = 0.5
  half_life = domain-dependent (see below)
```

| Cynefin Domain | Half-Life | Rationale |
|---|---|---|
| Simple | 730 days (2 years) | Best practices change slowly |
| Complicated | 365 days (1 year) | Good practices evolve |
| Complex | 180 days (6 months) | Context-dependent solutions may drift |
| Chaotic | 90 days (3 months) | Experimental solutions change rapidly |

**Decay applies to individual validations, not to the solution.** A solution continuously re-validated by diverse sources maintains its trust score. A solution validated once and never again slowly decays.

**Re-validation resets the clock** for that specific validation, but only if the re-validator provides new evidence (not a copy of the original).

### 4.5 Rate Limiting

- A single vault can submit at most 1 validation per solution per 30-day period
- A single vault can submit at most 20 validations per 30-day period across all solutions
- Rate limits are enforced at the federation layer, not by individual vaults
- Rate limits prevent spam but are generous enough for active participants

---

## 5. The AI Boundary (ISC-Trust-5)

### 5.1 What AI Can Do

AI systems (LLMs, automated agents) operating within the Commons may:

| Action | Description | Requires Human Approval |
|---|---|---|
| **Index** | Parse solution records and extract metadata | No |
| **Tag** | Suggest tags, Cynefin classifications, and related solutions | No (suggestions only) |
| **Discover** | Search, rank, and recommend solutions to users | No |
| **Suggest validations** | Identify solutions that would benefit from validation and recommend them to human validators | No |
| **Flag anomalies** | Detect potential gaming, stale solutions, broken provenance chains | No (flags only) |
| **Draft evidence** | Help a human validator structure their validation evidence | No (human submits) |
| **Summarise** | Generate summaries of trust vectors, provenance chains, and validation histories | No |
| **Pattern analysis** | Identify cross-cutting patterns across solutions (e.g., "solutions in this domain tend to decay faster") | No |

### 5.2 What AI Cannot Do

AI systems operating within the Commons MUST NOT:

| Prohibited Action | Rationale |
|---|---|
| **Promote to canonical/proven/foundational** | Human sovereignty -- trust decisions are human decisions |
| **Submit validations autonomously** | Validations represent human judgement; AI has no standing to validate |
| **Override human decisions** | A human's decision to reject, demote, or challenge is final |
| **Auto-approve solutions** | The Commons is not an AI-curated feed |
| **Modify provenance chains** | Provenance is a historical record; AI cannot rewrite history |
| **Classify Cynefin domain without human approval** | Domain classification requires contextual judgement |
| **Remove or suppress solutions** | Censorship decisions require human governance |
| **Execute trust score recalculations that change thresholds** | Threshold changes are governance decisions |

### 5.3 Enforcement Mechanism

The AI boundary is enforced at two levels:

1. **Protocol level** -- Validation events, promotion events, and Cynefin classification events REQUIRE an `ActorRef` with `type: "human"`. Events submitted with `type: "ai"` for these action types are rejected by the federation layer.

2. **Convention level** -- AI tools that interact with the Commons are expected to comply with these boundaries. Tools that violate them risk having their vault's trust score penalised. This is a social contract backed by detectability (all actions are logged in provenance chains with actor types).

### 5.4 The "AI-Suggested, Human-Approved" Pattern

The recommended interaction model:

```
1. AI identifies a solution that matches a user's context
2. AI presents the solution with its trust vector and provenance summary
3. Human evaluates the solution in their context
4. Human submits validation (or challenge) with evidence
5. Human approves any resulting trust score changes
```

AI accelerates the discovery and evaluation loop. Humans own the trust decisions. This mirrors the existing Observer Vault principle: "AI articulates, humans decide."

---

## 6. The GitHub Attention Model, Adapted (ISC-Trust-6)

### 6.1 What Translates

| GitHub Signal | Commons Equivalent | Translation Notes |
|---|---|---|
| **Stars** | Endorsements | Weakest signal. "I've seen this and it looks interesting." Stars map to a lightweight endorsement that contributes minimally to trust (0.1x weight vs full validation). Useful for discovery ranking, not for trust scoring. |
| **Forks** | Derivations | Strong signal. A fork means someone adapted the solution for their context. This is an implicit validation: the solution was worth building on. Forks with their own validations create a trust tree. |
| **Pull Requests** | Contributions | Strongest collaborative signal. Direct improvement of the solution. PRs that are accepted increase documentation_quality and may trigger re-validation. |
| **Issues** | Challenges & Discussion | Dual signal -- issues can be bug reports (challenges to trust) or feature requests (evidence of use). Resolved issues increase trust. Unresolved issues decrease it. |
| **Contributor Diversity** | Validation Diversity | Direct mapping. More diverse contributors = higher confidence that the solution is robust across contexts. |
| **CI Status** | Test Coverage | Automated test results from CI translate directly to the test_coverage dimension. |
| **Releases/Tags** | Version Stability | A solution with tagged versions signals maturity and intentional maintenance. |

### 6.2 What Does NOT Translate

| GitHub Feature | Why It Fails in Commons Context |
|---|---|
| **Star count as ranking** | Stars measure popularity, not trustworthiness. A popular but flawed solution would rank highly. The Commons needs to separate "widely known" from "independently verified." |
| **Maintainer authority** | GitHub grants maintainers special status. The Commons has no maintainer -- solutions belong to the commons. Governance is collective, not individual. |
| **Merge authority** | In GitHub, maintainers decide what gets merged. In the Commons, there is no central merge authority. Forks are first-class citizens, not subordinate. |
| **Private repositories** | The Commons is public by design. Private solutions are an oxymoron in a commons context. (Vaults can keep solutions private; they just don't participate in commons trust.) |
| **Organisation verification badges** | GitHub's blue checkmarks are centrally granted. The Commons has no central authority to grant badges. Trust is earned through the trust vector, not bestowed. |
| **Automated vulnerability scanning** | GitHub's security tools assume code. Commons solutions may be patterns, processes, or designs that cannot be scanned. Trust must work for non-code solutions too. |

### 6.3 What the Commons Does Better

| Commons Advantage | Why It Exceeds GitHub's Model |
|---|---|
| **Independence measurement** | GitHub doesn't measure whether two stargazers are independent. The Commons explicitly tracks and weights independence. |
| **Context-aware trust** | GitHub stars are context-free. "This solution works for healthcare at scale" is richer than "42 stars." |
| **Cynefin classification** | GitHub treats all repos the same. The Commons distinguishes best practices (Simple) from emergent practices (Complex) and adjusts trust models accordingly. |
| **Validation evidence** | GitHub stars require zero evidence. Commons validations require structured evidence of testing. |
| **Trust decay** | GitHub stars never expire. Commons validations decay, ensuring trust reflects current reality. |
| **Federated governance** | GitHub repos have single-owner governance. Commons solutions have collective, federated governance with no central authority. |

### 6.4 The "Attention Funnel"

GitHub's implicit trust ladder, adapted:

```
Awareness  (GitHub: Star)       --> Commons: Endorsement (lightweight, low trust signal)
    |
Engagement (GitHub: Issue)      --> Commons: Challenge/Discussion (bidirectional trust signal)
    |
Adoption   (GitHub: Fork)      --> Commons: Derivation (strong trust signal)
    |
Contribution (GitHub: PR)      --> Commons: Contribution (strongest collaborative signal)
    |
Validation (GitHub: CI pass)   --> Commons: Formal Validation (trust-accruing event)
    |
Endorsement (no GitHub equiv)  --> Commons: Independent Validation with Evidence
```

The Commons adds the final two layers that GitHub lacks: formal validation with structured evidence, and independence-weighted trust scoring.

---

## 7. Governance Structure

### 7.1 Principles

1. **No Central Authority** -- No single vault, organisation, or individual controls the trust system
2. **Transparent Rules** -- All trust calculations, thresholds, and decay rates are public and auditable
3. **Human Override** -- Any automated trust decision can be challenged and overridden by human governance
4. **Incremental Change** -- Governance rules change through proposal, comment period, and consensus
5. **Exit Rights** -- Any vault can leave the federation at any time, taking their solutions with them

### 7.2 Governance Actions

| Action | Who Can Propose | Who Approves | Mechanism |
|---|---|---|---|
| Change trust weights | Any vault | 2/3 of active vaults | Proposal with 30-day comment period |
| Change validation thresholds | Any vault | 2/3 of active vaults | Proposal with 30-day comment period |
| Challenge a solution's trust score | Any vault | Human review panel (3 randomly selected vault operators) | Challenge event in provenance chain |
| Reclassify Cynefin domain | Any vault | Originating vault + 2 confirming vaults | Proposal with evidence |
| Add new trust dimension | Any vault | 3/4 of active vaults | Major governance change, 60-day comment period |
| Suspend a vault for gaming | Collusion detection system | Human review panel (5 randomly selected vault operators) | Evidence-based, with appeal process |

### 7.3 Governance Without Blockchain

This governance model does not require a blockchain. It requires:

1. **Signed provenance events** -- each vault signs its events with its keypair
2. **Federation gossip** -- events propagate through the federation layer (defined in 02-federation-spec.md)
3. **Deterministic computation** -- any vault can independently compute trust scores from the same provenance data and get the same result
4. **Social consensus** -- governance decisions are human decisions, recorded as provenance events

Blockchains solve the problem of untrusted parties agreeing on a shared ledger. The Observer Commons solves a different problem: trusted-enough parties (vaults that chose to federate) agreeing on solution quality. The federation's trust model is closer to PGP's web of trust than to Bitcoin's proof of work.

### 7.4 Dispute Resolution

When trust scores are contested:

1. **Challenge filed** -- Any vault submits a challenge event with evidence
2. **Automatic hold** -- Solution's confidence level is frozen during review (cannot be promoted)
3. **Review panel** -- Three vault operators randomly selected from federation (excluding challenger and solution author)
4. **Evidence review** -- Panel reviews challenge evidence and solution provenance within 14 days
5. **Resolution** -- Panel votes (majority wins): uphold challenge (trust adjusted), dismiss challenge (no change), or request more evidence
6. **Appeal** -- Losing party can appeal once, to a panel of 5 (different operators)
7. **Final** -- Appeal decision is final; recorded in provenance chain

---

## 8. Implementation: Incremental Build Path

### 8.1 Phase 1: Minimum Viable Trust (MVP)

**Goal:** Get basic trust scoring working with manual validations.

- Trust vector with 3 dimensions: validation_count, validation_diversity, documentation_quality
- Simple independence check: same vault = not independent, different vault = independent
- Confidence levels: speculative, provisional, tested (no proven/foundational yet)
- Provenance: creation and validation events only
- Cynefin: all solutions start as Disorder, manual classification only
- No decay, no anti-gaming, no governance voting
- AI boundary enforced at protocol level (human-only validations)

### 8.2 Phase 2: Independence and Context

**Goal:** Add real independence measurement and context awareness.

- Full independence model (Section 1.3) with organisational diversity
- Context tags on validations
- Trust vector expands to all 6 dimensions
- Cynefin-adjusted trust scoring (Section 3.2)
- Basic trust decay (simple half-life model)
- Provenance: all event types
- Confidence levels: full ladder including proven and foundational

### 8.3 Phase 3: Anti-Gaming and Governance

**Goal:** Harden the system against manipulation.

- Sybil resistance: vault identity binding, proof of engagement, cool-down periods
- Collusion detection: reciprocity analysis, temporal clustering, graph analysis
- Rate limiting
- Governance voting mechanism
- Dispute resolution process
- AI anomaly flagging

### 8.4 Phase 4: Advanced Trust

**Goal:** Sophisticated trust model for a mature commons.

- Validator reputation (based on accuracy of past validations)
- Cross-domain trust transfer (a vault trusted in healthcare has partial trust in regulated industries)
- Predictive trust (AI identifies solutions likely to decay based on patterns)
- Trust visualisation tools
- Federation-wide trust analytics

---

## 9. Data Structures (Reference)

### 9.1 Trust Vector (stored on solution record)

```
{
  "trust": {
    "vector": {
      "validation_count": 12,
      "validation_diversity": 0.73,
      "context_breadth": 0.45,
      "temporal_stability": 0.88,
      "test_coverage": 0.60,
      "documentation_quality": 0.80
    },
    "composite_score": 0.68,
    "confidence": "tested",
    "cynefin_domain": "complicated",
    "effective_validation_count": 8.4,
    "last_validation": "2026-02-15T10:30:00Z",
    "validation_count_raw": 12,
    "oldest_active_validation": "2025-08-01T14:00:00Z"
  }
}
```

### 9.2 Validation Record

```
{
  "validation_id": "uuid-here",
  "solution_id": "solution-uuid",
  "solution_version": "1.2.0",
  "validator": {
    "vault_id": "vault-uuid",
    "vault_org": "acme-corp",
    "actor": {
      "type": "human",
      "id": "alice@acme",
      "org": "acme-corp"
    }
  },
  "context": {
    "description": "Applied to microservice auth layer in production",
    "tags": ["authentication", "microservices", "production", "healthcare"],
    "environment": {
      "language": "typescript",
      "framework": "express",
      "scale": "10k-requests-per-second"
    }
  },
  "outcome": "success",
  "evidence_type": "production_use",
  "evidence_hash": "sha256:abc123...",
  "duration_of_use": "6 months",
  "independence_level": null,
  "timestamp": "2026-02-15T10:30:00Z",
  "signature": "vault-signature-here"
}
```

### 9.3 Provenance Event

```
{
  "event_id": "uuid-here",
  "timestamp": "2026-02-15T10:30:00Z",
  "event_type": "validation",
  "actor": {
    "type": "human",
    "id": "alice@acme",
    "org": "acme-corp"
  },
  "vault_id": "vault-uuid",
  "parent_id": "previous-event-uuid",
  "payload": {
    "validation_id": "validation-uuid",
    "outcome": "success",
    "evidence_hash": "sha256:abc123..."
  },
  "signature": "vault-signature-of-event-content",
  "chain_hash": "sha256:hash-of-this-event-plus-parent-hash"
}
```

---

## 10. Pre-Mortem: What Could Go Wrong

### 10.1 Trust System Failure Modes

| Failure Mode | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Cold start problem** | HIGH | No validations exist, so no trust scores, so no one uses the system | Phase 1 bootstraps with vault-local trust; federation trust grows organically. Allow solutions to be useful even with zero external validations. |
| **Gaming overwhelms detection** | MEDIUM | Sophisticated actors circumvent anti-gaming measures | Layered defence makes gaming expensive, not impossible. Human review as backstop. Accept that some gaming will occur and design for resilience, not prevention. |
| **Trust becomes popularity** | MEDIUM | Large organisations dominate validation, drowning out small contributors | Diversity weighting explicitly counters this. One org's 100 validations count less than 10 orgs' 10 validations each. But requires calibration. |
| **Governance deadlock** | MEDIUM | Federated governance fails to reach consensus on rule changes | Supermajority thresholds (2/3, not unanimity). Default to status quo if no consensus. Any vault can fork the governance rules (exit rights). |
| **Over-engineering trust** | HIGH | Trust system so complex that no one understands or trusts it | Phased build: start with MVP trust (Phase 1), add complexity only when proven necessary. The trust system must be simpler than the problems it solves. |
| **Stale solutions** | MEDIUM | Solutions remain "proven" long after they are obsolete | Trust decay addresses this, but decay rates must be calibrated. Phase 1 launches without decay; Phase 2 adds it. |
| **Provenance chain bloat** | LOW | Long-lived solutions accumulate thousands of provenance events | Provenance is append-only but can be summarised. "Checkpoint" events that hash the full chain into a single summary event. |
| **AI boundary erosion** | MEDIUM | Pressure to let AI auto-validate to scale the system | The boundary is constitutional: documented, enforced at protocol level, and enshrined in governance rules. Changing it requires a supermajority governance vote. Resist the temptation of efficiency. |

### 10.2 The Biggest Risk

The biggest risk is that the trust system is so onerous that nobody validates anything. Validation requires effort: structured evidence, context documentation, honest assessment. If this effort is not rewarded or is perceived as bureaucratic, contributors will skip it.

**Mitigation:** Make validation easy and rewarding.
- Phase 1 validations are lightweight (outcome + context description only)
- AI assists with evidence structuring (AI drafts, human approves)
- Validation benefits the validator (access to trust data, discovery of related solutions)
- Make the minimum viable validation genuinely minimal

---

## 11. Sovereignty Check: Does This Design Preserve Human Control?

### 11.1 Sovereignty Audit

| Question | Answer | Evidence |
|---|---|---|
| Can AI promote solutions to canonical/trusted? | NO | Section 5.2: explicit prohibition. Section 5.3: enforced at protocol level. |
| Can AI submit validations? | NO | Validations require `ActorRef.type == "human"`. AI can draft evidence but human must submit. |
| Can AI override human decisions? | NO | Section 5.2: explicit prohibition. Human decisions are final. |
| Can any single entity control trust scores? | NO | Trust is computed from independent validations. No single entity's validations dominate (diversity weighting). |
| Can a contributor leave and take their work? | YES | Section 7.1: exit rights. Solutions are portable. |
| Can governance rules be changed without consent? | NO | Section 7.2: changes require supermajority with comment periods. |
| Can the trust system function without AI? | YES | Section 8.1: Phase 1 has zero AI dependency. AI is an accelerator, not a requirement. |
| Can a human challenge any trust decision? | YES | Section 7.4: dispute resolution process with human review panels. |

### 11.2 The Sovereignty Invariant

> **At every point in the trust lifecycle, a human can intervene, override, or exit. No automated process can prevent this. This invariant must hold across all phases of implementation.**

This is not merely a design goal. It is a constitutional constraint. Any future modification to this trust framework that violates this invariant is invalid regardless of governance vote.

---

## 12. Simplicity Check: Is This the Simplest Version That Could Work?

### 12.1 Complexity Budget

| Component | Complexity | Justification | Could Be Simpler? |
|---|---|---|---|
| Trust vector (6 dimensions) | Medium | Single score hides critical information. 6 dimensions is the minimum to capture independence, diversity, context, time, evidence, and documentation. | Phase 1 starts with 3 dimensions. |
| Independence model | Medium | Without independence measurement, the system is a popularity contest. This is the core of surveyor epistemology. | Phase 1 uses binary (same vault / different vault). |
| Cynefin gates | Medium | Different problem domains genuinely need different trust models. A one-size-fits-all approach fails for complex domains. | Phase 1 starts with "Disorder" for everything. |
| Provenance chain | Medium-High | This is the most complex component. But without provenance, trust is unverifiable. | Phase 1 uses creation + validation events only. |
| Anti-gaming | Medium | Without anti-gaming, the system is trivially exploitable. But over-engineering it makes participation hard. | Phase 3 addition, not Phase 1. |
| Governance | Medium | Federated governance is inherently complex. But centralised governance violates core principles. | Phase 3 addition. Start with informal governance. |

### 12.2 What Was Deliberately Excluded

- **Reputation tokens / currency** -- Adds complexity without clear benefit over the trust vector. Solutions are not bought or sold.
- **Blockchain / distributed ledger** -- Signed provenance events provide tamper evidence without the overhead of consensus mechanisms. The federation is not adversarial enough to justify blockchain costs.
- **Weighted voting by vault size** -- Violates the principle that all independent measurements are valuable. A small vault's validation is as meaningful as a large vault's.
- **Automated trust-based access control** -- Trust scores inform humans, they don't gate access. Any vault can access any public solution regardless of trust score.
- **Machine learning for trust scoring** -- Trust computation is deterministic and auditable. ML introduces opacity that conflicts with the "glass box" principle.

### 12.3 The Simplicity Test

**Phase 1 passes the simplicity test if:**
1. A vault operator can understand the trust model in 10 minutes
2. A contributor can submit a validation in under 2 minutes
3. Trust scores can be computed by hand from the provenance data
4. The system works without AI, without blockchain, without complex infrastructure
5. Three vaults can federate and build trust within one week

If Phase 1 fails any of these tests, it is too complex.

---

## 13. Open Questions (For Future Decision)

1. **Trust score portability** -- When a vault leaves the federation, do their validations persist in the provenance chain? (Proposed: yes, but decayed faster since re-validation is impossible.)

2. **Cross-commons trust** -- If multiple Observer Commons instances exist, can trust transfer between them? (Proposed: not in Phase 1. Evaluate when the need arises.)

3. **Validator anonymity** -- Should validators be able to submit anonymous validations? (Proposed: no. Accountability requires identity. Pseudonymity is acceptable; anonymity is not.)

4. **Trust for non-technical solutions** -- The current model is biased toward testable, technical solutions. How does trust work for process patterns, management approaches, or philosophical frameworks? (Proposed: Cynefin classification handles this -- philosophical frameworks are Complex domain by default.)

5. **Trust score display** -- Should consuming vaults see the full trust vector or just the composite score? (Proposed: always show the vector. Let humans decide what dimensions matter to them.)

6. **Validation effort scaling** -- As the commons grows, validation requests may overwhelm individual contributors. What mechanisms prevent validation fatigue? (Proposed: AI-assisted prioritisation, validation request routing based on vault expertise.)

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Commons** | The shared federation of solution records across participating vaults |
| **Composite Trust Score (CTS)** | Single numeric value derived from trust vector via weighted geometric mean |
| **Cynefin** | Dave Snowden's sense-making framework categorising problems into Simple, Complicated, Complex, Chaotic, and Disorder domains |
| **Effective Validation Count** | Validation count weighted by independence level |
| **Federation** | The network of vaults that share and validate solutions |
| **Independence** | The degree to which two validations represent genuinely separate evaluations |
| **Provenance Chain** | Append-only, hash-linked sequence of events recording a solution's full history |
| **Surveyor Epistemology** | Truth established through multiple independent measurements, not single authority |
| **Sybil Attack** | Creating multiple fake identities to manipulate a trust system |
| **Trust Vector** | Six-dimensional representation of solution trustworthiness |
| **Validation** | A structured assertion by a human that a solution works in a specified context |
| **Vault** | An individual Observer instance participating in the federation |

---

## Appendix B: ISC Criteria Traceability

| Criterion | Section | Status |
|---|---|---|
| ISC-Trust-1: Multi-source trust scoring | Section 1 (Trust Model Architecture) | SATISFIED |
| ISC-Trust-2: Provenance tracking | Section 2 (Provenance Tracking) | SATISFIED |
| ISC-Trust-3: Cynefin gates | Section 3 (Cynefin Gates) | SATISFIED |
| ISC-Trust-4: Anti-gaming measures | Section 4 (Anti-Gaming Measures) | SATISFIED |
| ISC-Trust-5: AI boundary | Section 5 (The AI Boundary) | SATISFIED |
| ISC-Trust-6: GitHub model analysis | Section 6 (GitHub Attention Model) | SATISFIED |
| ISC-A-Trust-1: No auto-promotion | Sections 5.2, 5.3, 11.1 | SATISFIED |

---

*This document is DRAFT. All thresholds, weights, and mechanisms are subject to revision based on implementation experience and community feedback. The principles (surveyor epistemology, human sovereignty, federated governance) are foundational and unlikely to change. The parameters (weights, decay rates, thresholds) are tunable and expected to evolve.*
