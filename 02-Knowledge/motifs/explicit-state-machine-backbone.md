---
name: "Explicit State Machine Backbone"
tier: 1
status: provisional
confidence: 0.3
source: "bottom-up"
domain_count: 3
created: 2026-03-03
updated: 2026-03-03
---

# Explicit State Machine Backbone

## Structural Description

A system's core control flow is organized around an explicit, enumerated set of states with defined transitions between them. The state machine is not implicit in conditional logic or hidden in flag combinations — it is a first-class structural element with named states, guarded transitions, and illegal transition rejection. All behavior is a consequence of which state the system occupies and which transitions are valid from that state.

## Domain-Independent Formulation

An enumerated set of named states with explicit, guarded transitions governing all system behavior.

## Instances

### Instance 1: Terminal UI Frameworks (Bubbletea)
- **Domain:** CLI / Terminal UI
- **Expression:** Bubbletea's Elm architecture structures every TUI application as an explicit state machine: Model holds the state, Update handles transitions via messages, View renders the current state. The framework enforces that all user interaction flows through the state machine — there is no way to mutate the UI without going through a state transition. Illegal transitions are structurally impossible because Update is the only path to state change.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — developer-tools: charmbracelet/bubbletea)

### Instance 2: Authentication Flows (Authelia, CAS)
- **Domain:** Authentication & Identity
- **Expression:** Authelia's authentication portal implements an explicit state machine for login flows: unauthenticated → first-factor → second-factor → authenticated, with each transition guarded by specific conditions (valid credentials, valid TOTP, valid WebAuthn). Invalid transitions (skipping 2FA, re-entering completed states) are rejected. CAS (Apereo) similarly models the authentication lifecycle as an explicit state machine with ticket states (TGT, ST, PGT) and defined transitions.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — web-development: authelia/authelia, apereo/cas)

### Instance 3: Database Migration Lifecycle (Flyway, fluentmigrator)
- **Domain:** Database Schema Management
- **Expression:** Flyway models each migration as a state machine: pending → applied → (optionally) undone. Migrations must be applied in order; skipping or reordering is an illegal transition. The migration state table is a persistent record of which state each migration occupies. fluentmigrator follows the same pattern — each migration version has a defined lifecycle with guarded transitions.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management: flyway/flyway, fluentmigrator/fluentmigrator)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | The state machine's transition rules are defined at slow/governance speed; state transitions execute at fast/operational speed |
| Idempotent State Convergence | tension | State machines enforce ordered transitions; idempotent convergence allows repeated application regardless of order |

## Discovery Context

Identified through bottom-up analysis of the 112-repo OCP scraper corpus during the triad run (2026-03-03). The pattern appeared independently in terminal UI frameworks (Bubbletea's Elm architecture), authentication systems (Authelia's login flow, CAS ticket lifecycle), and database migration tools (Flyway's migration states). In each case, the system's correctness depends on making the state machine explicit rather than implicit in conditional logic.

## Falsification Conditions

- If the "state machine" is just an enum with no guarded transitions (any state can transition to any other), this is merely "having states" — not a structural pattern
- If the system works equally well with implicit conditional logic (if/else chains) and gains nothing from explicit state enumeration, the motif is cosmetic, not structural
- If the state machine has so many states and transitions that it becomes unmanageable (state explosion), the pattern may be an anti-pattern at scale rather than a motif
