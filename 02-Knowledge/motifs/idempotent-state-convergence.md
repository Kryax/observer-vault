---
name: "Idempotent State Convergence"
tier: 1
status: provisional
confidence: 0.7
source: "triangulated"
domain_count: 5
created: 2026-03-03
updated: 2026-03-03
---

# Idempotent State Convergence

## Structural Description

A system achieves its desired state through operations that can be applied multiple times with the same result. Rather than imperative "do X once" commands, the system declares a target state and repeatedly applies convergence operations until actual state matches desired state. Repeated application is safe — the operation detects when work is already done and becomes a no-op. This makes the system self-healing: any disruption is corrected by re-running the same convergence operation.

## Domain-Independent Formulation

Repeatedly applicable operations that converge actual state toward declared desired state, where re-application is always safe.

## Instances

### Instance 1: Kubernetes State Reconciliation (kube-state-metrics context)
- **Domain:** Container Orchestration / Infrastructure
- **Expression:** Kubernetes' controller model is the canonical example: controllers continuously reconcile actual cluster state toward declared desired state (manifests). Every reconciliation loop is idempotent — running the controller again when state already matches is a no-op. kube-state-metrics exposes this convergence gap as metrics, making the distance between actual and desired state observable.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — devops: kubernetes/kube-state-metrics)

### Instance 2: Database Migration Convergence (golang-migrate, goose, dbmate)
- **Domain:** Database Schema Management
- **Expression:** Migration tools converge a database schema toward a declared target version. Running migrations is idempotent — if a migration is already applied, it's skipped. golang-migrate, goose, and dbmate all track applied migrations and only execute the delta to reach the target state. Re-running the full migration set on an up-to-date database is a safe no-op.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management: golang-migrate/migrate, pressly/goose, amacneil/dbmate)

### Instance 3: Monitoring Rule Application (OneUptime, Grafana)
- **Domain:** Monitoring / Alerting
- **Expression:** Monitoring systems declare desired alerting state (which rules should be active, what thresholds apply) and continuously evaluate whether actual state matches. OneUptime's monitoring configuration is declarative — adding or re-applying the same monitor is idempotent. Grafana's provisioning system converges dashboard and alert state toward declared YAML/JSON configurations, with re-application safe.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — devops: oneuptime/oneuptime; data-management: grafana/grafana)

### Instance 4: Backend-as-a-Service (PocketBase, Nhost)
- **Domain:** Backend-as-a-Service / Application Platform
- **Expression:** PocketBase and Nhost both declare backend schemas (collections, auth rules, storage policies) as configuration that converges the running backend toward the declared state. Re-applying the same schema definition is idempotent — collections that already exist are skipped, rules that already match are no-ops. Nhost's `nhost config deploy` converges the remote environment toward the local config declaration. PocketBase's admin API accepts collection definitions idempotently. Both treat the backend as a desired-state system where re-application is always safe and convergence is the primary correctness mechanism.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — web-development: pocketbase/pocketbase, nhost/nhost)

### Instance 5: Bioinformatics Pipeline Resumption (Bottom-Up — Nextflow, ColabFold)
- **Domain:** Bioinformatics / Computational Biology
- **Expression:** Nextflow's `-resume` flag is textbook idempotent convergence. Re-running a pipeline with the same inputs converges to the same outputs — already-completed tasks are detected via cached results and skipped (safe no-op). The pipeline declares a desired state (all tasks completed successfully) and converges toward it through repeated application. ColabFold caches intermediate protein structure predictions, making re-prediction idempotent. This is essential for reproducible science — you MUST be able to re-run and get the same result. The convergence gap (incomplete vs. complete pipeline) is observable via task status.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — bioinformatics: nextflow-io/nextflow 3.3k★, sokrypton/ColabFold 2.6k★)

### Non-instances from Alien Domain Testing

**Game Engines:** Real-time simulation with player input is inherently non-deterministic and non-convergent. Each frame produces NEW state based on player input, not convergence toward a declared desired state. Game ticks accumulate side effects by design — the opposite of idempotent convergence.

**Music Production:** Rendering a project is deterministic (same project → same audio output), but this is deterministic computation, not convergence. There's no "desired state" that the system converges toward through repeated operations. You render once and get the output.

**Spaced Repetition:** Each review CHANGES the card state — re-running the same review produces DIFFERENT scheduling results because the card's stability and difficulty parameters update. The operation is intentionally non-idempotent.

**Domain Constraint Note:** This motif appears to be structurally constrained to pipeline/declarative-state systems (infrastructure, CI/CD, bioinformatics). Interactive/real-time domains do not exhibit this pattern because their operations intentionally mutate state rather than converge toward declared desired state.

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Explicit State Machine Backbone | tension | State machines enforce ordered transitions; idempotent convergence relaxes ordering in favor of repeated safe application |
| Dual-Speed Governance | complement | The desired state declaration is a slow-cycle governance artifact; convergence operations execute at fast-cycle operational speed |

## Discovery Context

**Bottom-up (2026-03-03, first triad run):** Identified across 112-repo OCP corpus in container orchestration (Kubernetes), database migration (golang-migrate, goose, dbmate), monitoring (OneUptime, Grafana), and BaaS (PocketBase, Nhost).

**Bottom-up (2026-03-03, alien domain triad run):** Confirmed in 1 alien domain — bioinformatics (Nextflow -resume, ColabFold caching). Explicitly tested and found NOT present in game engines (non-deterministic), music production (deterministic but not convergent), and spaced repetition (intentionally non-idempotent). These honest non-instances reveal the motif is domain-constrained to pipeline/declarative-state systems.

**Triangulation confirmed:** Bottom-up from infrastructure + bottom-up from bioinformatics.

## Confidence Score Arithmetic

| Step | Event | Change | Running Total |
|------|-------|--------|---------------|
| 1 | Instance 1 (Container Orchestration) | Start at 0.1 | 0.1 |
| 2 | Instance 2 (DB Migration) | +0.1 | 0.2 |
| 3 | Instance 3 (Monitoring) | +0.1 | 0.3 |
| 4 | Instance 4 (BaaS) | +0.1 | 0.4 |
| 5 | Instance 5 (Bioinformatics, alien) | +0.1 | 0.5 |
| 6 | Triangulation confirmed (infra + alien) | +0.2 | 0.7 |

**Final: 0.7.** Lower than siblings due to fewer alien confirmations (1 vs 3) and documented domain constraint.

## Falsification Conditions

- If the "idempotent" operations have side effects that accumulate on re-application (e.g., creating duplicate records), the convergence property is broken
- If the system requires careful ordering of operations to achieve correctness (i.e., idempotency is claimed but not real), this is just "imperative with retry" — not convergence
- If the gap between actual and desired state is never observable or measurable, the "convergence" is unfalsifiable — you can't verify the system is actually converging
