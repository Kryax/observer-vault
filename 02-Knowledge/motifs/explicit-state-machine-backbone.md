---
name: "Explicit State Machine Backbone"
tier: 2
status: canonical
confidence: 0.9
source: "triangulated"
domain_count: 7
created: 2026-03-03
updated: 2026-03-04
promoted: 2026-03-04
promotion_justification: "7 domains, 0.9 confidence, alien-domain triangulation (game engines, spaced repetition, music production). All 5 validation protocol conditions satisfied."
cssclasses:
  - status-canonical
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

### Instance 4: CI/CD Pipeline Execution (Dagger)
- **Domain:** CI/CD / Build Systems
- **Expression:** Dagger models pipeline execution as an explicit state machine where each build step occupies a defined state (queued → running → succeeded | failed | cancelled). Transitions are guarded: a step cannot move to "running" unless its dependencies have "succeeded"; a step cannot be "cancelled" once "succeeded." The pipeline DAG is a composition of per-step state machines. Invalid transitions (running a step with unmet dependencies, re-running a completed pipeline without reset) are structurally rejected. The entire build's correctness depends on the state machine being explicit and transition-guarded, not hidden in shell script conditionals.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — machine-learning: dagger/dagger)

### Instance 5: Game Engine State Systems (Bottom-Up — Godot, Bevy, libGDX)
- **Domain:** Game Engine Architecture
- **Expression:** Game engines use explicit state machines as THE primary architectural pattern. Godot provides first-class `AnimationStateMachine` nodes with named states, blend transitions, and transition rules. Bevy's `States` derive macro creates explicit state enums with type-level transition guards — `OnEnter(GameState::Playing)`, `OnExit(GameState::Paused)` — where invalid transitions are compile-time errors. libGDX enforces application lifecycle states (create → resize → render → pause → resume → dispose) with guarded transitions. In each case, the state machine is not incidental — game correctness depends on explicit state enumeration.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — game-development: godotengine/godot 107k★, bevyengine/bevy 45k★, libgdx/libgdx 25k★)

### Instance 6: Spaced Repetition Card Lifecycle (Bottom-Up — FSRS4Anki)
- **Domain:** Spaced Repetition / Cognitive Science
- **Expression:** FSRS4Anki models card memory as an explicit state machine: New → Learning → Review → Relearning. Transitions are guarded by answer ratings (Again → Relearning, Good → Review, Easy → skip Learning). A New card CANNOT jump directly to Review — it must transition through Learning. The scheduling algorithm IS the transition function — given the current state and a rating input, it deterministically produces the next state and interval. The state machine maps directly to cognitive science models of memory acquisition stages, making this a problem-shaped rather than engineer-shaped use of the motif.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — spaced-repetition: open-spaced-repetition/fsrs4anki 3.8k★)

### Instance 7: DAW Transport State Machine (Bottom-Up — Zrythm)
- **Domain:** Music Production / Audio Engineering
- **Expression:** Zrythm's transport implements an explicit state machine: Stopped → Playing → Recording → Paused, with guarded transitions (cannot Record without Playing first; Pausing preserves playhead position; stopping resets it). The undoable action system implies a second state machine over project history — each user action transitions between project states, with undo/redo as reverse transitions along the state chain. Standard for media applications, but the transitions are genuinely guarded, not just flags.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — music-production: zrythm/zrythm 2.9k★)

## Validation Protocol (Tier 2)

All five conditions satisfied:

1. **Domain-independent description:** YES — "An enumerated set of named states with explicit, guarded transitions governing all system behavior" uses no domain-specific vocabulary.
2. **Cross-domain recurrence:** YES — 7 unrelated domains: Terminal UI, Authentication, Database Migration, CI/CD, Game Engines, Spaced Repetition, Music Production.
3. **Predictive power:** YES — Knowing this motif in any new domain immediately suggests: enumerate all possible states, name them explicitly, define valid transitions with guards, and reject illegal transitions structurally. Transforms implicit flag-based conditionals into explicit, auditable state control.
4. **Adversarial survival:** YES — This is not merely "having state" or "using enums." The structural claim is specific: (a) states are named and enumerated, (b) transitions are explicitly defined and guarded, (c) illegal transitions are rejected, and (d) all behavior derives from which state the system occupies. Systems with implicit state in flag combinations or unbounded conditionals do not satisfy this.
5. **Clean failure:** YES — See Falsification Conditions section.

## Counterexamples / Non-instances

Systems or domains where explicit state machines plausibly *could* apply but structurally do not:

### Non-instance 1: Event-Sourced Systems Without Explicit State Enums (e.g., pure CQRS projections)

Events are appended to an immutable log and projections derive current state by replaying the event stream. There are no named states, no guarded transitions — the "state" is whatever the projection function computes from history. Any sequence of events is valid (append-only log); there's no concept of an "illegal transition" because there are no transitions at all — only event accumulation. The structural difference: event sourcing's state is emergent from history, not enumerated with guarded transitions. A projection can be in any shape the replay produces.

### Non-instance 2: Spreadsheet Formula Evaluation

Cells hold values and formulas; the "state" of the spreadsheet is the totality of cell values after recalculation. There are no named states, no transitions, and no guards. Any cell can hold any value at any time. The recalculation engine treats all changes equally — there's no concept of a legal vs. illegal state transition. You can put "hello" in a cell that previously held a number without any guard rejecting it. This is unconstrained mutation, structurally opposite to guarded state transitions.

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | The state machine's transition rules are defined at slow/governance speed; state transitions execute at fast/operational speed |
| Idempotent State Convergence | tension | State machines enforce ordered transitions; idempotent convergence allows repeated application regardless of order |

## Discovery Context

**Bottom-up (2026-03-03, first triad run):** Identified across 112-repo OCP corpus in terminal UI (Bubbletea), authentication (Authelia, CAS), database migration (Flyway), and CI/CD (Dagger).

**Bottom-up (2026-03-03, alien domain triad run):** Confirmed across 3 alien domains. Game engines (Godot AnimationStateMachine, Bevy States — state machines are THE primary architectural pattern in game development), spaced repetition (FSRS4Anki card lifecycle — problem-shaped, maps to cognitive science), and music production (Zrythm transport — standard but genuinely guarded).

**Triangulation confirmed:** Bottom-up from infrastructure + bottom-up from alien domains with zero overlap.

## Confidence Score Arithmetic

| Step | Event | Change | Running Total |
|------|-------|--------|---------------|
| 1 | Instance 1 (Terminal UI) | Start at 0.1 | 0.1 |
| 2 | Instance 2 (Auth) | +0.1 | 0.2 |
| 3 | Instance 3 (DB Migration) | +0.1 | 0.3 |
| 4 | Instance 4 (CI/CD) | +0.1 | 0.4 |
| 5 | Instance 5 (Game Engines, alien) | +0.1 | 0.5 |
| 6 | Instance 6 (Spaced Repetition, alien) | +0.1 | 0.6 |
| 7 | Instance 7 (Music Production, alien) | +0.1 | 0.7 |
| 8 | Triangulation confirmed (infra + alien) | +0.2 | 0.9 |

**Final: 0.9.**

## Falsification Conditions

- If the "state machine" is just an enum with no guarded transitions (any state can transition to any other), this is merely "having states" — not a structural pattern
- If the system works equally well with implicit conditional logic (if/else chains) and gains nothing from explicit state enumeration, the motif is cosmetic, not structural
- If the state machine has so many states and transitions that it becomes unmanageable (state explosion), the pattern may be an anti-pattern at scale rather than a motif
